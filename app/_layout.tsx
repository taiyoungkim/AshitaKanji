// Design Ref: §6 State Management + §2 Layer Architecture — root layout
// Plan SC: 앱 시작 시 DB 초기화 (번들 jlpt.db 복사 + 마이그레이션)
//
// Root: ThemeProvider + 폰트 로드 + QueryClientProvider + RootErrorBoundary + DB init gate.

import { useEffect, useState } from 'react';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { QueryClientProvider } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { setAudioModeAsync } from 'expo-audio';
import { queryClient } from '~/lib/queryClient';
import { RootErrorBoundary } from '~/lib/errorBoundary';
import { initAds } from '~/lib/ads/interstitialManager';
import { getDatabase } from '~/db/open';
import { ToastProvider } from '~/components/Toast';
import { typography, type ThemeColors } from '~/design/tokens';
import { ThemeProvider, useTheme, useThemedStyles } from '~/design/theme';

export default function RootLayout(): React.ReactNode {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<Error | null>(null);

  // Pretendard JP — 위계를 굵기로 만드는 서체라 weight 별 패밀리를 각각 로드한다.
  // 일본어 자형이 필요한 학습 카드 때문에 plain 판이 아니라 JP 판을 쓴다.
  const [fontsLoaded, fontError] = useFonts({
    'PretendardJP-Regular': require('../assets/fonts/PretendardJP-Regular.otf'),
    'PretendardJP-Medium': require('../assets/fonts/PretendardJP-Medium.otf'),
    'PretendardJP-SemiBold': require('../assets/fonts/PretendardJP-SemiBold.otf'),
    'PretendardJP-Bold': require('../assets/fonts/PretendardJP-Bold.otf'),
    'PretendardJP-ExtraBold': require('../assets/fonts/PretendardJP-ExtraBold.otf'),
  });

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

  // 폰트 로드 실패는 치명적이지 않다 — 시스템 폰트로 떨어뜨리고 계속 간다.
  useEffect(() => {
    if (fontError) console.warn('[font] Pretendard load failed:', fontError);
  }, [fontError]);

  const ready = dbReady && (fontsLoaded || fontError != null);

  return (
    <ThemeProvider>
      <ThemedStatusBar />
      {ready ? (
        <RootErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <ToastProvider>
              <RootStack />
            </ToastProvider>
          </QueryClientProvider>
        </RootErrorBoundary>
      ) : (
        <BootGate />
      )}
    </ThemeProvider>
  );
}

function ThemedStatusBar(): React.ReactNode {
  const { name } = useTheme();
  return <StatusBar style={name === 'dark' ? 'light' : 'dark'} />;
}

function BootGate(): React.ReactNode {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.ink} />
      <Text style={styles.loadingText}>준비 중…</Text>
    </View>
  );
}

function RootStack(): React.ReactNode {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: colors.softer },
        headerTintColor: colors.ink,
        headerTitleStyle: {
          color: colors.ink,
          fontFamily: typography.cardTitle.fontFamily,
          fontSize: typography.cardTitle.fontSize,
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.softer },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="intro" options={{ headerShown: false }} />
      <Stack.Screen name="tutorial" options={{ headerShown: false }} />
      <Stack.Screen name="study" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      <Stack.Screen name="done" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
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
      {/* 단어 상세는 바텀시트 패턴이다 (COMPONENTS.md 11c).
          헤더는 화면이 직접 그린다 — 좌 44 닫기 + 가운데 "단어 상세". */}
      <Stack.Screen
        name="word/[id]"
        options={{ headerShown: false, presentation: 'modal' }}
      />
      <Stack.Screen name="onigiri/[id]" options={{ headerShown: false }} />
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
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.softer,
    },
    loadingText: { marginTop: 12, ...typography.body, color: c.body },
    headerCloseBtn: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerClose: {
      fontSize: 20,
      lineHeight: 24,
      color: c.ink,
      textAlign: 'center',
      minWidth: 24,
    },
  });
