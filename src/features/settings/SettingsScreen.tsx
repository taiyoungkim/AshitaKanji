// 최신 설정 IA — 메인에서는 현재값을 요약하고, 편집은 역할별 하위 화면에서 한다.

import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cardShadow, layout, radius, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useThemedStyles } from '~/design/theme';
import { useSettingsStore } from '~/stores/SettingsStore';

export default function SettingsScreen(): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const selectedLevels = useSettingsStore((state) => state.selectedLevels);
  const dailyNewLimit = useSettingsStore((state) => state.dailyNewLimit);
  const ttsEnabled = useSettingsStore((state) => state.ttsEnabled);
  const ttsSpeed = useSettingsStore((state) => state.ttsSpeed);
  const version = Constants.expoConfig?.version ?? '—';

  const learningSummary = `${selectedLevels.join(' · ')} · 하루 ${dailyNewLimit}개`;
  const pronunciationSummary = `${ttsEnabled ? '켜짐' : '꺼짐'} · ${ttsSpeed.toFixed(1)}x`;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>설정</Text>

        <View style={styles.group}>
          <SettingsRow
            label="학습 설정"
            summary={learningSummary}
            onPress={() => router.push('/settings-learning')}
          />
          <View style={styles.divider} />
          <SettingsRow
            label="발음 설정"
            summary={pronunciationSummary}
            onPress={() => router.push('/settings-pronunciation')}
          />
        </View>

        <View style={styles.group}>
          <SettingsRow
            label="데이터 백업"
            summary="JSON"
            onPress={() => router.push('/settings-backup')}
          />
          <View style={styles.divider} />
          <SettingsRow label="앱 정보" onPress={() => router.push('/about')} />
        </View>

        <Text style={styles.version}>앱 버전 {version} · 최신버전</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsRow({
  label,
  summary,
  onPress,
}: {
  label: string;
  summary?: string;
  onPress: () => void;
}): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={summary ? `${label}, ${summary}` : label}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowEnd}>
        {summary ? <Text style={styles.summary}>{summary}</Text> : null}
        <Text style={styles.chevron}>›</Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.softer },
    content: {
      paddingHorizontal: layout.gutter,
      paddingTop: spacing.xl,
      paddingBottom: spacing.huge,
      gap: spacing.lg,
    },
    title: { ...typography.meaning, color: colors.ink, marginBottom: spacing.sm },
    group: {
      overflow: 'hidden',
      borderRadius: radius.card,
      backgroundColor: colors.canvas,
      ...cardShadow(colors),
    },
    row: {
      minHeight: 64,
      paddingHorizontal: spacing.xl,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    rowPressed: { backgroundColor: colors.soft },
    rowLabel: { ...typography.cardTitle, color: colors.ink },
    rowEnd: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexShrink: 1 },
    summary: { ...typography.body, color: colors.body, flexShrink: 1 },
    chevron: { fontSize: 30, lineHeight: 32, color: colors.mute },
    divider: {
      height: StyleSheet.hairlineWidth,
      marginHorizontal: spacing.xl,
      backgroundColor: colors.pressed,
    },
    version: { ...typography.caption, color: colors.mute, marginTop: spacing.xs, marginLeft: spacing.xs },
  });
