// Root index — 앱 진입 시 항상 인트로(고양이 첫 인사) 먼저.
// 인트로 "시작하기" → /home.
//
// 개발용 시각 캡처 빌드는 Documents/ui-capture-fixture.txt를 한 번 읽고 삭제한 뒤
// 실제 production 화면을 deterministic fixture로 준비한다. 파일/빌드 플래그가 없는
// 일반 설치에서는 이 분기가 번들 UI에 노출되지 않는다.

import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTheme } from '~/design/theme';
import { isVisualCaptureEnabled, isVisualFixtureId, type VisualFixtureId } from '~/visual/captureFixtures';

export default function Index(): React.ReactNode {
  const { colors } = useTheme();
  const [fixture, setFixture] = useState<VisualFixtureId | null | undefined>(
    isVisualCaptureEnabled() ? undefined : null,
  );

  useEffect(() => {
    if (!isVisualCaptureEnabled()) return;
    const marker = `${FileSystem.documentDirectory ?? ''}ui-capture-fixture.txt`;
    void FileSystem.readAsStringAsync(marker)
      .then(async (value) => {
        await FileSystem.deleteAsync(marker, { idempotent: true });
        const candidate = value.trim();
        setFixture(isVisualFixtureId(candidate) ? candidate : null);
      })
      .catch(() => setFixture(null));
  }, []);

  if (fixture === undefined) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.softer }]}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }
  if (fixture) {
    return <Redirect href={`/_dev/ui-capture?fixture=${encodeURIComponent(fixture)}` as never} />;
  }
  return <Redirect href="/intro" />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
