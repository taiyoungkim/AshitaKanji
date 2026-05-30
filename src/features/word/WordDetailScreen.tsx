// Design Ref: §5.6 단어 상세 — surface/reading/뜻/예문/attribution/타입/별표기 + TTS.
// Plan SC: Tatoeba 예문 문장별 출처 표기 (CC BY 2.0 FR). 학습데이터 외부 송신 없음(on-device).
//
// 데이터: getDatabase() → SqliteCardRepo.findById(id). 읽기 전용 (FSRS 상태 변경 없음).

import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getDatabase } from '~/db/open';
import { SqliteCardRepo } from '~/db/repos/sqlite/SqliteCardRepo';
import type { Word } from '~/types/Card';
import { CARD_TYPE_LABEL_KO, renderKanjiFace } from '~/lib/cardType';
import { useTTS } from '~/hooks/useTTS';

type LoadState =
  | { phase: 'loading' }
  | { phase: 'notfound' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; word: Word };

// CardReveal.attributionLine 과 동일 규칙 (CC BY 2.0 FR 표기).
function attribution(word: Word): string | null {
  const author = word.example_jp_author;
  const lic = word.example_license;
  if (!author && !lic) return null;
  const parts: string[] = [];
  if (author) parts.push(`© ${author}`);
  if (lic) parts.push(lic === 'self' ? '자체 제작' : lic);
  return parts.join(' · ');
}

export default function WordDetailScreen(): React.ReactNode {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<LoadState>({ phase: 'loading' });
  const tts = useTTS();

  useEffect(() => {
    let alive = true;
    if (!id) {
      setState({ phase: 'notfound' });
      return;
    }
    void (async () => {
      try {
        const db = await getDatabase();
        const word = await new SqliteCardRepo(db).findById(id);
        if (!alive) return;
        setState(word ? { phase: 'ready', word } : { phase: 'notfound' });
      } catch (e) {
        if (!alive) return;
        setState({ phase: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  if (state.phase === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#0366d6" />
      </View>
    );
  }
  if (state.phase === 'notfound') {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>🔍</Text>
        <Text style={styles.emptyText}>단어를 찾을 수 없어요.</Text>
      </View>
    );
  }
  if (state.phase === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>⚠️</Text>
        <Text style={styles.emptyText}>불러오기 실패</Text>
        <Text style={styles.errorDetail}>{state.message}</Text>
      </View>
    );
  }

  const w = state.word;
  const attr = w.example_jp ? attribution(w) : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 헤드: 표기 + 읽기 + 발음 */}
      <View style={styles.head}>
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>{w.level}</Text>
        </View>
        <Text style={styles.surface}>{renderKanjiFace(w)}</Text>
        {w.furigana && <Text style={styles.furigana}>{w.furigana}</Text>}
        <Text style={styles.reading}>{w.reading_kana}</Text>
        <Pressable
          style={[styles.ttsBtn, tts.status === 'unsupported' && styles.ttsBtnOff]}
          onPress={() => tts.speak(w.reading_kana)}
          disabled={!tts.enabled || tts.status === 'unsupported'}
          accessibilityLabel="발음 듣기"
          accessibilityRole="button"
        >
          <Text style={styles.ttsIcon}>🔊 발음 듣기</Text>
        </Pressable>
        {tts.status === 'unsupported' && (
          <Text style={styles.ttsHint}>이 기기는 일본어 음성을 지원하지 않아요.</Text>
        )}
        {!tts.enabled && (
          <Text style={styles.ttsHint}>설정에서 발음 듣기(TTS)를 켜면 음성이 나와요.</Text>
        )}
      </View>

      {/* 뜻 */}
      <Section title="뜻">
        <Text style={styles.meaning}>{w.meaning_ko}</Text>
        {w.part_of_speech && <Text style={styles.pos}>{w.part_of_speech}</Text>}
      </Section>

      {/* 예문 */}
      {w.example_jp && (
        <Section title="예문">
          <View style={styles.exampleRow}>
            <Text style={styles.exampleJp}>{w.example_jp}</Text>
            <Pressable
              onPress={() => tts.speak(w.example_jp)}
              disabled={!tts.enabled || tts.status === 'unsupported'}
              accessibilityLabel="예문 발음 듣기"
              accessibilityRole="button"
            >
              <Text style={styles.exampleTts}>🔊</Text>
            </Pressable>
          </View>
          {w.example_ko && <Text style={styles.exampleKo}>{w.example_ko}</Text>}
          {attr && <Text style={styles.attribution}>{attr}</Text>}
        </Section>
      )}

      {/* 추가 정보 */}
      {(w.alt_forms?.length || w.disambig) && (
        <Section title="추가 정보">
          {w.alt_forms?.length ? (
            <Text style={styles.infoLine}>
              <Text style={styles.infoLabel}>다른 표기 </Text>
              {w.alt_forms.join(', ')}
            </Text>
          ) : null}
          {w.disambig && (
            <Text style={styles.infoLine}>
              <Text style={styles.infoLabel}>구분 </Text>
              {w.disambig}
            </Text>
          )}
        </Section>
      )}

      {/* 메타 */}
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{CARD_TYPE_LABEL_KO[w.card_type]}</Text>
      </View>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f7' },
  content: { padding: 20, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: 16, color: '#666', fontWeight: '600' },
  errorDetail: { fontSize: 12, color: '#aaa', textAlign: 'center' },
  head: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 6,
  },
  levelBadge: {
    backgroundColor: '#eef2f6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 4,
  },
  levelText: { fontSize: 12, fontWeight: '700', color: '#0366d6' },
  surface: { fontSize: 48, fontWeight: '800', color: '#1a1a1a' },
  furigana: { fontSize: 15, color: '#999' },
  reading: { fontSize: 22, color: '#2a9d8f', fontWeight: '600' },
  ttsBtn: {
    marginTop: 12,
    backgroundColor: '#eef2f6',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  ttsBtnOff: { opacity: 0.4 },
  ttsIcon: { fontSize: 15, color: '#0366d6', fontWeight: '700' },
  ttsHint: { fontSize: 11, color: '#aaa', marginTop: 2 },
  section: { backgroundColor: 'white', borderRadius: 14, padding: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#888' },
  sectionBody: { marginTop: 8, gap: 6 },
  meaning: { fontSize: 20, color: '#1a1a1a', fontWeight: '600' },
  pos: { fontSize: 13, color: '#888' },
  exampleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  exampleJp: { flex: 1, fontSize: 18, color: '#1a1a1a', lineHeight: 28 },
  exampleTts: { fontSize: 20 },
  exampleKo: { fontSize: 14, color: '#666', lineHeight: 20 },
  attribution: { fontSize: 11, color: '#bbb', marginTop: 6 },
  infoLine: { fontSize: 14, color: '#444', lineHeight: 20 },
  infoLabel: { color: '#999', fontWeight: '600' },
  metaRow: { alignItems: 'center', marginTop: 4 },
  metaText: { fontSize: 12, color: '#bbb' },
});
