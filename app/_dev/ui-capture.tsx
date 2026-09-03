import { useEffect, useState } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '~/design/theme';
import { typography } from '~/design/tokens';
import {
  isVisualCaptureEnabled,
  isVisualFixtureId,
  prepareVisualFixture,
} from '~/visual/captureFixtures';

export default function VisualCaptureBootstrap(): React.ReactNode {
  const { fixture } = useLocalSearchParams<{ fixture?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isVisualCaptureEnabled() || !isVisualFixtureId(fixture)) return;
    let active = true;
    void prepareVisualFixture(fixture)
      .then((target) => {
        if (active) router.replace(target as never);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      active = false;
    };
  }, [fixture, router]);

  if (!isVisualCaptureEnabled()) return <Redirect href="/" />;
  if (!isVisualFixtureId(fixture)) return <Redirect href="/" />;

  return (
    <View style={[styles.root, { backgroundColor: colors.softer }]}>
      {error ? (
        <Text style={[styles.text, { color: colors.danger }]}>{error}</Text>
      ) : (
        <>
          <ActivityIndicator color={colors.ink} />
          <Text style={[styles.text, { color: colors.body }]}>fixture 준비 중…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  text: { ...typography.body, textAlign: 'center' },
});
