// Design Ref: §5.1 /about — 라이선스 + Example Sources + 앱 정보.
// Plan SC(데이터 출처/Play 정책): 데이터셋·예문 라이선스 정직 표기.
//   - 단어 데이터: 범위 확정 PDF 핵심어 전량 포함 편집자 큐레이션 7,027개
//   - 예문: 권리 확인된 NAVER 일본어사전 6,856개 + 자체 작성 171개
//   - "빈도 상위"/"JLPT 전체" 표현 금지 → "핵심 선별" 사용.

import Constants from 'expo-constants';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { font, radius, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useThemedStyles } from '~/design/theme';
import { useBottomInset } from '~/hooks/useScreenInsets';

// 출시 표준 URL — bundleId(com.taiyoungkim.*)·site/·release-gate 와 동일 출처로 통일.
// (이전 ktyoung153.github.io/ashitakanji 는 심사 링크 엇갈림 유발 → 폐기)
const PRIVACY_URL = 'https://taiyoungkim.github.io/AshitaKanji/privacy/';
const SUPPORT_URL = 'https://taiyoungkim.github.io/AshitaKanji/support/';

interface LicenseItem {
  title: string;
  body: string;
  license: string;
}

const LICENSES: LicenseItem[] = [
  {
    title: '단어 데이터',
    body: 'JLPT N5~N1 핵심 선별 7,027 단어. 범위를 확정한 PDF 핵심어 2,360개를 모두 포함하고, 중복과 비어휘 패턴을 검수해 구성했습니다.',
    license: '편집 데이터',
  },
  {
    title: '예문 데이터',
    body: '권리 확인된 NAVER 일본어사전 예문 6,856개와 AshitaKanji가 직접 작성·번역한 예문 171개를 사용합니다. 자체 예문은 외부 사전과 공개 코퍼스로 용법을 교차 확인했습니다.',
    license: '혼합',
  },
  {
    title: '한자 데이터',
    body: '한자 읽기·부수·획수 데이터는 EDRDG KANJIDIC2를 기반으로 합니다. 한국어 뜻 초안은 검수 상태를 추적하며, 앱 내 출처와 라이선스를 함께 표기합니다.',
    license: 'CC BY-SA 4.0',
  },
  {
    title: '글꼴',
    body: '앱 전체 글꼴은 Pretendard JP를 사용합니다. 한국어와 라틴 문자에 더해 일본어 자형을 포함해 학습 카드의 한자·가나를 온전히 표시합니다.',
    license: 'Pretendard JP / SIL Open Font License 1.1',
  },
  {
    title: '간격 반복 알고리즘',
    body: 'FSRS 스케줄링은 오픈소스 ts-fsrs 라이브러리를 사용합니다.',
    license: 'MIT',
  },
  {
    title: '앱 프레임워크',
    body: 'Expo · React Native 로 제작되었습니다.',
    license: 'MIT',
  },
];

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

      <Section title="데이터 출처 · 라이선스">
        {LICENSES.map((l) => (
          <View key={l.title} style={styles.licenseItem}>
            <View style={styles.licenseHead}>
              <Text style={styles.licenseTitle}>{l.title}</Text>
              <Text style={styles.licenseBadge}>{l.license}</Text>
            </View>
            <Text style={styles.licenseBody}>{l.body}</Text>
          </View>
        ))}
      </Section>

      <Section title="광고">
        <Text style={styles.licenseBody}>
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
  licenseItem: { gap: spacing.xs },
  licenseHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  licenseTitle: { ...typography.caption, fontFamily: font.medium, color: c.ink },
  licenseBadge: {
    ...typography.overline,
    color: c.body,
    borderWidth: 1,
    borderColor: c.pressed,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
    textTransform: 'none',
    letterSpacing: 0,
  },
  licenseBody: { ...typography.caption, color: c.body, lineHeight: 19 },
  link: { ...typography.caption, color: c.ink, fontFamily: font.medium },
  privacyNote: { ...typography.overline, color: c.body, textAlign: 'center', lineHeight: 18, marginTop: spacing.xs, textTransform: 'none', letterSpacing: 0 },
});
