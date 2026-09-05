// Design Ref: §5.1 /about — 앱 정보 + 광고 고지 + 개인정보/지원 링크.
// 데이터셋·글꼴 라이선스 표기는 앱에서 빼고 배포 사이트(site/index.html 푸터)에서 유지한다.

import Constants from 'expo-constants';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { font, radius, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useThemedStyles } from '~/design/theme';
import { useBottomInset } from '~/hooks/useScreenInsets';

// 출시 표준 URL — bundleId(com.taiyoungkim.*)·site/·release-gate 와 동일 출처로 통일.
// (이전 ktyoung153.github.io/ashitakanji 는 심사 링크 엇갈림 유발 → 폐기)
const PRIVACY_URL = 'https://taiyoungkim.github.io/AshitaKanji/privacy/';
const SUPPORT_URL = 'https://taiyoungkim.github.io/AshitaKanji/support/';


export default function AboutScreen(): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  const bottomInset = useBottomInset();
  const version = Constants.expoConfig?.version ?? '—';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + bottomInset }]}
    >
      <Text style={styles.appName}>오니칸</Text>
      <Text style={styles.appKanji}>오니기리 칸지</Text>
      <Text style={styles.version}>버전 {version}</Text>

      <Text style={styles.tagline}>
        오늘 외운 한자, 내일도 기억나게.{'\n'}매일 조금씩, N5에서 N1까지.
      </Text>

      <Section title="광고">
        <Text style={styles.sectionText}>
          학습 세션이 끝나면 Google 광고(전면)가 나올 수 있습니다. 카드를 채점하는 중에는
          광고를 띄우지 않습니다. iOS에서는 맞춤 광고를 위해 추적 권한을 물을 수 있고,
          거부해도 학습은 그대로 됩니다.
        </Text>
      </Section>

      <Section title="개인정보 · 지원">
        <LinkRow label="개인정보 처리방침" onPress={() => void Linking.openURL(PRIVACY_URL)} />
        <LinkRow label="지원 · 문의" onPress={() => void Linking.openURL(SUPPORT_URL)} />
      </Section>

      <Text style={styles.privacyNote}>
        학습 기록은 이 기기에만 저장됩니다. 백업은 설정에서 직접 내보낼 때만 생성됩니다.
        광고와 앱 업데이트 확인은 Google·Expo가 기기 정보를 처리할 수 있습니다.
      </Text>
    </ScrollView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function LinkRow({ label, onPress }: { label: string; onPress: () => void }): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  return (
    <Text style={styles.link} onPress={onPress} accessibilityRole="link">
      {label} ↗
    </Text>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: c.softer },
  content: { padding: spacing.xl, gap: spacing.lg, alignItems: 'center' },
  appName: { ...typography.resultTitle, color: c.ink, marginTop: spacing.sm },
  appKanji: { fontSize: 18, lineHeight: 24, color: c.body, fontFamily: font.medium },
  version: { ...typography.caption, color: c.body },
  tagline: { ...typography.caption, color: c.body, textAlign: 'center', lineHeight: 22, marginVertical: spacing.sm },
  section: {
    backgroundColor: c.canvas,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: 6,
    alignSelf: 'stretch',
  },
  sectionTitle: { ...typography.body, fontFamily: font.medium, color: c.ink },
  sectionBody: { marginTop: spacing.sm, gap: spacing.lg },
  sectionText: { ...typography.caption, color: c.body, lineHeight: 19 },
  link: { ...typography.caption, color: c.ink, fontFamily: font.medium },
  privacyNote: { ...typography.overline, color: c.body, textAlign: 'center', lineHeight: 18, marginTop: spacing.xs, textTransform: 'none', letterSpacing: 0 },
});
