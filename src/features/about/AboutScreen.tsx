// Design Ref: §5.1 /about — 라이선스 + Example Sources + 앱 정보.
// Plan SC(데이터 출처/Play 정책): 데이터셋·예문 라이선스 정직 표기.
//   - 단어 데이터: 편집자 큐레이션 6,200개. 문법·접사 패턴 제외 후 단어형 후보로 보강
//   - 예문: Tatoeba 또는 권리 확인된 NAVER 일본어사전 예문 — 문장별 출처 표기
//   - "빈도 상위"/"JLPT 전체" 표현 금지 → "핵심 선별" 사용.

import Constants from 'expo-constants';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

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
    body: 'JLPT N5~N1 핵심 선별 6,200 단어. 문법·접사 패턴은 제외하고 원본 CSV의 중복 없는 단어형 후보로 보강했습니다. Kaggle "JLPT words by level" (Robin Pourtaud) 데이터를 기반으로 검수·가공했습니다.',
    license: 'CC BY 4.0',
  },
  {
    title: '예문 (Tatoeba)',
    body: '일부 예문은 Tatoeba 프로젝트의 문장을 사용합니다. 문장별 기여자는 단어 상세 화면에 표기하며, 전체 기여자 명단은 앱에 함께 포함되어 있습니다.',
    license: 'CC BY 2.0 FR',
  },
  {
    title: '예문 (NAVER 일본어사전)',
    body: '권리 확인이 완료된 네이버 일본어사전 예문을 학습 문맥 예문으로 사용합니다. 예문 출처와 권리 확인 상태는 단어 상세 화면에 함께 표기합니다.',
    license: '사용 허가 확인',
  },
  {
    title: '한자 데이터',
    body: '한자 읽기·부수·획수 데이터는 EDRDG KANJIDIC2를 기반으로 합니다. 한국어 뜻 초안은 검수 상태를 추적하며, 앱 내 출처와 라이선스를 함께 표기합니다.',
    license: 'CC BY-SA 4.0',
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
  const version = Constants.expoConfig?.version ?? '—';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.appName}>아시타칸지</Text>
      <Text style={styles.appKanji}>明日漢字</Text>
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

      <Section title="개인정보 · 지원">
        <LinkRow label="개인정보 처리방침" onPress={() => void Linking.openURL(PRIVACY_URL)} />
        <LinkRow label="지원 · 문의" onPress={() => void Linking.openURL(SUPPORT_URL)} />
      </Section>

      <Text style={styles.privacyNote}>
        학습 기록은 이 기기에만 저장되며, 자동으로 외부에 전송되지 않습니다. 백업은 설정에서
        직접 내보낼 때만 생성됩니다.
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
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function LinkRow({ label, onPress }: { label: string; onPress: () => void }): React.ReactNode {
  return (
    <Text style={styles.link} onPress={onPress} accessibilityRole="link">
      {label} ↗
    </Text>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f7' },
  content: { padding: 20, gap: 16, alignItems: 'center' },
  appName: { fontSize: 30, fontWeight: '800', color: '#1a1a1a', marginTop: 8 },
  appKanji: { fontSize: 18, color: '#0366d6', fontWeight: '700' },
  version: { fontSize: 13, color: '#999' },
  tagline: { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 22, marginVertical: 8 },
  section: { backgroundColor: 'white', borderRadius: 14, padding: 16, gap: 6, alignSelf: 'stretch' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  sectionBody: { marginTop: 8, gap: 12 },
  licenseItem: { gap: 4 },
  licenseHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  licenseTitle: { fontSize: 15, fontWeight: '600', color: '#333' },
  licenseBadge: {
    fontSize: 11,
    color: '#0366d6',
    backgroundColor: '#eef2f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  licenseBody: { fontSize: 13, color: '#666', lineHeight: 19 },
  link: { fontSize: 15, color: '#0366d6', fontWeight: '600' },
  privacyNote: { fontSize: 12, color: '#aaa', textAlign: 'center', lineHeight: 18, marginTop: 4 },
});
