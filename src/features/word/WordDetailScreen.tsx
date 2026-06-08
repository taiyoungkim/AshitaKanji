// Design Ref: §5.6 단어 상세 — surface/reading/뜻/예문/attribution/타입/별표기 + TTS.
// 예문은 권리 확인된 외부 사전 출처 (출처 라벨 비표시). 학습데이터 외부 송신 없음(on-device).
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
import { colors, fontWeight, radius, spacing, typography } from '~/design/tokens';
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

// CardReveal.attributionLine 과 동일 규칙 (자체 제작 예문만 표기).
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
  // 외부 사전(NAVER 등) 예문은 출처·라벨 비표시. 자체 제작 예문만 표기.
  return example.license === 'self' ? '자체 제작' : null;
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
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }
  if (state.phase === 'notfound') {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>단어를 찾을 수 없어요.</Text>
      </View>
    );
  }
  if (state.phase === 'error') {
    return (
      <View style={styles.center}>
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
          onPress={() => tts.speakAudio('word', w.id, w.reading_kana)}
          onLongPress={() => copyAndToast(renderKanjiFace(w))}
          accessibilityRole="button"
          accessibilityLabel="발음 듣기"
          accessibilityHint="탭하면 발음, 길게 누르면 복사돼요"
        >
          {renderKanjiFace(w)}
        </Text>
        {/* 읽기는 표기와 다를 때만 (가나 단어는 표기==읽기라 중복 숨김) */}
        {renderKanjiFace(w) !== w.reading_kana && (
          <Text style={styles.reading}>{w.reading_kana}</Text>
        )}
        <Pressable
          style={[styles.ttsBtn, tts.status === 'unsupported' && styles.ttsBtnOff]}
          onPress={() => tts.speakAudio('word', w.id, w.reading_kana)}
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
                      onPress={() => tts.speakAudio('example', example.word_id, example.jp)}
                      onLongPress={() => copyAndToast(example.jp)}
                      accessibilityHint="누르면 읽어주고, 길게 누르면 복사돼요"
                    >
                      {example.jp}
                    </Text>
                    <Pressable
                      onPress={() => tts.speakAudio('example', example.word_id, example.jp)}
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
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm },
  emptyText: { ...typography.body, color: colors.textSecondary, fontWeight: fontWeight.medium },
  errorDetail: { ...typography.tiny, color: colors.textTertiary, textAlign: 'center', textTransform: 'none', letterSpacing: 0 },
  head: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    gap: 6,
  },
  levelBadge: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: spacing.xs,
  },
  levelText: { ...typography.tiny, color: colors.textSecondary, textTransform: 'none', letterSpacing: 0 },
  surface: { fontSize: 48, lineHeight: 54, fontWeight: fontWeight.medium, color: colors.text, letterSpacing: -1 },
  furigana: { ...typography.small, color: colors.textTertiary },
  reading: { fontSize: 22, lineHeight: 28, color: colors.textSecondary, fontWeight: fontWeight.medium },
  ttsBtn: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: spacing.sm,
  },
  ttsBtnOff: { opacity: 0.4 },
  ttsIcon: { ...typography.small, color: colors.text, fontWeight: fontWeight.medium },
  ttsHint: { ...typography.tiny, color: colors.textTertiary, marginTop: 2, textTransform: 'none', letterSpacing: 0 },
  dictBtn: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  dictBtnText: { ...typography.small, color: colors.text, fontWeight: fontWeight.medium },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  sectionTitle: { ...typography.tiny, color: colors.textSecondary },
  sectionBody: { marginTop: spacing.sm, gap: 6 },
  meaning: { fontSize: 20, lineHeight: 26, color: colors.text, fontWeight: fontWeight.medium },
  pos: { ...typography.small, color: colors.textSecondary },
  exampleStack: { gap: spacing.md },
  exampleCard: {
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  exampleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  exampleJp: { flex: 1, fontSize: 18, lineHeight: 28, color: colors.text },
  exampleTts: { fontSize: 20 },
  exampleTtsOff: { opacity: 0.35 },
  exampleKo: { ...typography.small, color: colors.textSecondary, lineHeight: 20 },
  attribution: { ...typography.tiny, color: colors.textTertiary, marginTop: 6, textTransform: 'none', letterSpacing: 0 },
  kanjiGrid: { gap: spacing.sm },
  kanjiCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.skeleton,
    padding: spacing.md,
    gap: spacing.xs,
  },
  kanjiLiteral: { fontSize: 34, lineHeight: 40, color: colors.text, fontWeight: fontWeight.medium },
  kanjiMeaning: { ...typography.small, color: colors.text, fontWeight: fontWeight.medium, lineHeight: 21 },
  kanjiReading: { ...typography.small, color: colors.textSecondary, lineHeight: 19 },
  kanjiMeta: { ...typography.tiny, color: colors.textTertiary, textTransform: 'none', letterSpacing: 0 },
  kanjiError: { ...typography.small, color: colors.textSecondary },
  infoLine: { ...typography.small, color: colors.text, lineHeight: 20 },
  infoLabel: { color: colors.textSecondary, fontWeight: fontWeight.medium },
  metaRow: { alignItems: 'center', marginTop: spacing.xs },
  metaText: { ...typography.tiny, color: colors.textTertiary, textTransform: 'none', letterSpacing: 0 },
  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.28)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: 2,
  },
  sheetLiteral: { fontSize: 64, lineHeight: 72, color: colors.text, fontWeight: fontWeight.medium, textAlign: 'center' },
  detailLine: { gap: 3 },
  detailLabel: { ...typography.tiny, color: colors.textSecondary, textTransform: 'none', letterSpacing: 0 },
  detailValue: { ...typography.body, color: colors.text, lineHeight: 23 },
  sheetActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  sheetDictBtn: {
    flex: 1,
    backgroundColor: colors.black,
    borderRadius: radius.pill,
    paddingVertical: 11,
    alignItems: 'center',
  },
  sheetDictText: { ...typography.small, color: colors.white, fontWeight: fontWeight.medium },
  sheetCloseBtn: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
  },
  sheetCloseText: { ...typography.small, color: colors.text, fontWeight: fontWeight.medium },
});
