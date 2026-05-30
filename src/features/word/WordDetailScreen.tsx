// Design Ref: §5.6 단어 상세 — surface/reading/뜻/예문/attribution/타입/별표기 + TTS.
// Plan SC: Tatoeba 예문 문장별 출처 표기 (CC BY 2.0 FR). 학습데이터 외부 송신 없음(on-device).
//
// 데이터: getDatabase() → SqliteCardRepo.findById(id). 읽기 전용 (FSRS 상태 변경 없음).

import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getDatabase } from '~/db/open';
import { SqliteCardRepo } from '~/db/repos/sqlite/SqliteCardRepo';
import { SqliteKanjiRepo } from '~/db/repos/sqlite/SqliteKanjiRepo';
import { SqliteWordExampleRepo } from '~/db/repos/sqlite/SqliteWordExampleRepo';
import type { Word } from '~/types/Card';
import type { KanjiForWord } from '~/types/Kanji';
import type { WordExample } from '~/types/WordExample';
import { CARD_TYPE_LABEL_KO, posLabelKo, renderKanjiFace } from '~/lib/cardType';
import { buildNaverJaDictSearchUrl } from '~/lib/kanji';
import { useTTS } from '~/hooks/useTTS';
import { useToast } from '~/components/Toast';
import { copyText } from '~/lib/clipboard';

type LoadState =
  | { phase: 'loading' }
  | { phase: 'notfound' }
  | { phase: 'error'; message: string }
  | {
      phase: 'ready';
      word: Word;
      kanji: KanjiForWord[];
      examples: WordExample[];
      kanjiError?: string;
    };

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

function legacyExample(word: Word): WordExample[] {
  if (!word.example_jp) return [];
  return [{
    id: 0,
    word_id: word.id,
    jp: word.example_jp,
    ko: word.example_ko ?? null,
    source: word.example_license === 'self' ? 'self' : 'legacy-word-column',
    source_url: null,
    license: word.example_license ?? null,
    permission_status: word.example_license === 'self' ? 'self' : 'cleared',
    attribution: attribution(word),
    captured_at: null,
    qa_status: 'verified',
    sort_order: 0,
  }];
}

function exampleAttribution(example: WordExample): string | null {
  const license = example.license === 'owner-confirmed-cleared' ? '사용 허가 확인' : example.license;
  const parts = [example.attribution, license].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export default function WordDetailScreen(): React.ReactNode {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<LoadState>({ phase: 'loading' });
  const [selectedKanji, setSelectedKanji] = useState<KanjiForWord | null>(null);
  const tts = useTTS();
  const toast = useToast();

  const copyAndToast = (text: string | null | undefined) => {
    void copyText(text).then((ok) => {
      if (ok) toast.show('복사했어요');
    });
  };

  useEffect(() => {
    let alive = true;
    setSelectedKanji(null);
    if (!id) {
      setState({ phase: 'notfound' });
      return;
    }
    void (async () => {
      try {
        const db = await getDatabase();
        const word = await new SqliteCardRepo(db).findById(id);
        if (!alive) return;
        if (!word) {
          setState({ phase: 'notfound' });
          return;
        }
        let kanji: KanjiForWord[] = [];
        let kanjiError: string | undefined;
        try {
          kanji = await new SqliteKanjiRepo(db).findForWord(word);
        } catch (kanjiErr) {
          kanjiError = kanjiErr instanceof Error ? kanjiErr.message : String(kanjiErr);
        }
        let examples: WordExample[] = [];
        try {
          examples = await new SqliteWordExampleRepo(db).findForWord(word.id);
        } catch {
          examples = [];
        }
        if (!alive) return;
        setState({ phase: 'ready', word, kanji, examples, kanjiError });
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
  const examples = state.examples.length > 0 ? state.examples : legacyExample(w);
  const openDictionary = (query: string) => {
    void Linking.openURL(buildNaverJaDictSearchUrl(query)).catch((err) => {
      console.warn('[word-detail] failed to open dictionary:', err);
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 헤드: 표기 + 읽기 + 발음 */}
      <View style={styles.head}>
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>{w.level}</Text>
        </View>
        <Text
          style={styles.surface}
          onLongPress={() => copyAndToast(renderKanjiFace(w))}
          accessibilityHint="길게 누르면 복사돼요"
        >
          {renderKanjiFace(w)}
        </Text>
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
        <Pressable
          style={styles.dictBtn}
          onPress={() => openDictionary(w.surface)}
          accessibilityLabel="네이버 일본어 사전에서 단어 보기"
          accessibilityRole="link"
        >
          <Text style={styles.dictBtnText}>네이버 사전 ↗</Text>
        </Pressable>
      </View>

      {/* 뜻 */}
      <Section title="뜻">
        <Text style={styles.meaning}>{w.meaning_ko}</Text>
        {posLabelKo(w.part_of_speech) && (
          <Text style={styles.pos}>{posLabelKo(w.part_of_speech)}</Text>
        )}
      </Section>

      {/* 한자 */}
      {(state.kanji.length > 0 || state.kanjiError) && (
        <Section title="한자">
          {state.kanjiError ? (
            <Text style={styles.kanjiError}>한자 데이터를 불러오지 못했어요.</Text>
          ) : (
            <View style={styles.kanjiGrid}>
              {state.kanji.map((item) => (
                <KanjiCard
                  key={`${item.literal}-${item.position}`}
                  item={item}
                  onPress={() => setSelectedKanji(item)}
                />
              ))}
            </View>
          )}
        </Section>
      )}

      {/* 예문 */}
      {examples.length > 0 && (
        <Section title="예문">
          <View style={styles.exampleStack}>
            {examples.map((example) => {
              const attr = exampleAttribution(example);
              return (
                <View key={`${example.id}-${example.sort_order}`} style={styles.exampleCard}>
                  <View style={styles.exampleRow}>
                    <Text
                      style={styles.exampleJp}
                      onPress={() => tts.speak(example.jp)}
                      onLongPress={() => copyAndToast(example.jp)}
                      accessibilityHint="누르면 읽어주고, 길게 누르면 복사돼요"
                    >
                      {example.jp}
                    </Text>
                    <Pressable
                      onPress={() => tts.speak(example.jp)}
                      disabled={!tts.enabled || tts.status === 'unsupported'}
                      style={!tts.enabled || tts.status === 'unsupported' ? styles.exampleTtsOff : null}
                      accessibilityLabel="예문 발음 듣기"
                      accessibilityRole="button"
                    >
                      <Text style={styles.exampleTts}>🔊</Text>
                    </Pressable>
                  </View>
                  {example.ko && (
                    <Text
                      style={styles.exampleKo}
                      onLongPress={() => copyAndToast(example.ko)}
                      accessibilityHint="길게 누르면 복사돼요"
                    >
                      {example.ko}
                    </Text>
                  )}
                  {attr && <Text style={styles.attribution}>{attr}</Text>}
                </View>
              );
            })}
          </View>
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
      <KanjiDetailSheet
        item={selectedKanji}
        onClose={() => setSelectedKanji(null)}
        onOpenDictionary={openDictionary}
      />
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

function KanjiCard({
  item,
  onPress,
}: {
  item: KanjiForWord;
  onPress: () => void;
}): React.ReactNode {
  const data = item.kanji;
  const meanings = data?.meanings_ko.slice(0, 3).join(' · ');
  const readings = [
    data?.onyomi.length ? `음 ${data.onyomi.slice(0, 3).join(' · ')}` : '',
    data?.kunyomi.length ? `훈 ${data.kunyomi.slice(0, 3).join(' · ')}` : '',
  ].filter(Boolean).join('\n');
  const radical = [data?.radical ? `부수 ${data.radical}` : '', data?.stroke_count ? `${data.stroke_count}획` : '']
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      style={styles.kanjiCard}
      onPress={onPress}
      accessibilityLabel={`${item.literal} 한자 상세 보기`}
      accessibilityRole="button"
    >
      <Text style={styles.kanjiLiteral}>{item.literal}</Text>
      {meanings ? <Text style={styles.kanjiMeaning} numberOfLines={2}>{meanings}</Text> : null}
      {readings ? <Text style={styles.kanjiReading} numberOfLines={2}>{readings}</Text> : null}
      {radical ? <Text style={styles.kanjiMeta}>{radical}</Text> : null}
    </Pressable>
  );
}

function KanjiDetailSheet({
  item,
  onClose,
  onOpenDictionary,
}: {
  item: KanjiForWord | null;
  onClose: () => void;
  onOpenDictionary: (query: string) => void;
}): React.ReactNode {
  if (!item) return null;
  const data = item.kanji;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetRoot}>
        <Pressable style={styles.sheetBackdrop} onPress={onClose} accessibilityLabel="닫기" />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetLiteral}>{item.literal}</Text>
          {data?.meanings_ko.length ? <DetailLine label="뜻" value={data.meanings_ko.join(' · ')} /> : null}
          {data?.onyomi.length ? <DetailLine label="음독" value={data.onyomi.join(' · ')} /> : null}
          {data?.kunyomi.length ? <DetailLine label="훈독" value={data.kunyomi.join(' · ')} /> : null}
          {data?.radical ? (
            <DetailLine
              label="부수"
              value={[
                data.radical,
                data.radical_name_ko,
                data.radical_number ? `${data.radical_number}번` : '',
              ].filter(Boolean).join(' · ')}
            />
          ) : null}
          {data?.stroke_count ? <DetailLine label="획수" value={`${data.stroke_count}획`} /> : null}
          {data?.source ? <DetailLine label="출처" value={data.source} /> : null}
          <View style={styles.sheetActions}>
            <Pressable
              style={styles.sheetDictBtn}
              onPress={() => onOpenDictionary(item.literal)}
              accessibilityLabel="네이버에서 한자 보기"
              accessibilityRole="link"
            >
              <Text style={styles.sheetDictText}>네이버에서 보기 ↗</Text>
            </Pressable>
            <Pressable style={styles.sheetCloseBtn} onPress={onClose} accessibilityRole="button">
              <Text style={styles.sheetCloseText}>닫기</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DetailLine({ label, value }: { label: string; value: string }): React.ReactNode {
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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
  dictBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#d6e2ef',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  dictBtnText: { fontSize: 14, color: '#0366d6', fontWeight: '700' },
  section: { backgroundColor: 'white', borderRadius: 14, padding: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#888' },
  sectionBody: { marginTop: 8, gap: 6 },
  meaning: { fontSize: 20, color: '#1a1a1a', fontWeight: '600' },
  pos: { fontSize: 13, color: '#888' },
  exampleStack: { gap: 12 },
  exampleCard: {
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#edf0f3',
    paddingBottom: 10,
  },
  exampleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  exampleJp: { flex: 1, fontSize: 18, color: '#1a1a1a', lineHeight: 28 },
  exampleTts: { fontSize: 20 },
  exampleTtsOff: { opacity: 0.35 },
  exampleKo: { fontSize: 14, color: '#666', lineHeight: 20 },
  attribution: { fontSize: 11, color: '#bbb', marginTop: 6 },
  kanjiGrid: { gap: 10 },
  kanjiCard: {
    borderWidth: 1,
    borderColor: '#edf0f3',
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  kanjiLiteral: { fontSize: 34, color: '#1a1a1a', fontWeight: '800' },
  kanjiMeaning: { fontSize: 15, color: '#333', fontWeight: '600', lineHeight: 21 },
  kanjiReading: { fontSize: 13, color: '#666', lineHeight: 19 },
  kanjiMeta: { fontSize: 12, color: '#999' },
  kanjiError: { fontSize: 13, color: '#999' },
  infoLine: { fontSize: 14, color: '#444', lineHeight: 20 },
  infoLabel: { color: '#999', fontWeight: '600' },
  metaRow: { alignItems: 'center', marginTop: 4 },
  metaText: { fontSize: 12, color: '#bbb' },
  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.28)' },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 12,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d8dce2',
    marginBottom: 2,
  },
  sheetLiteral: { fontSize: 64, color: '#1a1a1a', fontWeight: '800', textAlign: 'center' },
  detailLine: { gap: 3 },
  detailLabel: { fontSize: 12, color: '#999', fontWeight: '700' },
  detailValue: { fontSize: 16, color: '#222', lineHeight: 23 },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  sheetDictBtn: {
    flex: 1,
    backgroundColor: '#0366d6',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  sheetDictText: { color: 'white', fontSize: 14, fontWeight: '800' },
  sheetCloseBtn: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#eef2f6',
    alignItems: 'center',
  },
  sheetCloseText: { color: '#444', fontSize: 14, fontWeight: '700' },
});
