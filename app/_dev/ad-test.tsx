// dev 전용 — 전면광고 E2E 테스트 화면. /_dev/ad-test 경로.
// 빈도 캡 우회, Google 테스트 광고 직접 로드 → LOADED 시 자동 표시.
// 시뮬레이터 터치 주입 불가 환경에서 딥링크만으로 광고 노출 검증 용도.

import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '~/design/tokens';

export default function AdTestScreen(): React.ReactNode {
  const [log, setLog] = useState<string[]>([`platform: ${Platform.OS}`]);
  const append = (line: string) => {
    console.log(`[ad-test] ${line}`);
    setLog((prev) => [...prev, line]);
  };

  useEffect(() => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      append('unsupported platform — skip');
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const gma = require('react-native-google-mobile-ads') as typeof import('react-native-google-mobile-ads');
      append('module loaded');
      void gma
        .default()
        .initialize()
        .then(() => {
          append('SDK initialized');
          const ad = gma.InterstitialAd.createForAdRequest(gma.TestIds.INTERSTITIAL);
          ad.addAdEventListener(gma.AdEventType.LOADED, () => {
            append('ad LOADED → show()');
            void ad.show();
          });
          ad.addAdEventListener(gma.AdEventType.OPENED, () => append('ad OPENED ✅'));
          ad.addAdEventListener(gma.AdEventType.CLOSED, () => append('ad CLOSED ✅'));
          ad.addAdEventListener(gma.AdEventType.ERROR, (err) =>
            append(`ad ERROR ❌ ${String((err as Error)?.message ?? err)}`),
          );
          append('loading test interstitial…');
          ad.load();
        });
    } catch (err) {
      append(`require failed ❌ ${String(err)}`);
    }
  }, []);

  return (
    <SafeAreaView style={styles.fill}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>AD TEST</Text>
        {log.map((line, i) => (
          <Text key={i} style={styles.line}>
            {line}
          </Text>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.lg, gap: spacing.xs },
  title: { ...typography.h2, color: colors.text, marginBottom: spacing.sm },
  line: { ...typography.small, color: colors.textSecondary },
});
