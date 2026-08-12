// Design Ref: §5.6 단어 상세 — surface/reading/뜻/예문/타입/별표기 + TTS.
// 예문은 권리 확인된 외부 사전 출처 (출처 라벨 비표시). 학습데이터 외부 송신 없음(on-device).
//
// 데이터: getDatabase() → SqliteCardRepo.findById(id). 읽기 전용 (FSRS 상태 변경 없음).

import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';
import { cardShadow, font, layout, radius, spacing, typography, type ThemeColors } from '~/design/tokens';
import { useColors, useThemedStyles } from '~/design/theme';
import { IconClose, IconSpeaker } from '~/design/icons';
import { getDatabase } from '~/db/open';
import { SqliteCardRepo } from '~/db/repos/sqlite/SqliteCardRepo';
import { SqliteKanjiRepo } from '~/db/repos/sqlite/SqliteKanjiRepo';
import { SqliteWordExampleRepo } from '~/db/repos/sqlite/SqliteWordExampleRepo';
import type { Word } from '~/types/Card';
import type { KanjiForWord } from '~/types/Kanji';
import type { WordExample } from '~/types/WordExample';
import { CARD_TYPE_LABEL_KO, posLabelKo, renderKanjiFace } from '~/lib/cardType';
import { buildNaverJaDictSearchUrl } from '~/lib/kanji';
import { useIsTablet } from '~/lib/device';
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
    attribution: null,
    captured_at: null,
    qa_status: 'verified',
    sort_order: 0,
  }];
}

export default function WordDetailScreen(): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<LoadState>({ phase: 'loading' });
  const [selectedKanji, setSelectedKanji] = useState<KanjiForWord | null>(null);
  const tts = useTTS();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  // Android의 native-stack modal은 edge-to-edge 상태에서 top inset을 0으로
  // 돌려주는 기기가 있다. 이 경우 상태바 높이를 보강해 닫기 버튼이 시스템
  // 시계/아이콘과 겹치지 않게 한다. iOS page modal은 native sheet 자체가
  // 상단 여백을 제공하므로 기존 11c 간격을 유지한다.
  const modalTopInset =
    Platform.OS === 'android'
      ? Math.max(
          insets.top,
          initialWindowMetrics?.insets.top ?? 0,
          StatusBar.currentHeight ?? 0,
        )
      : 0;

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
        <ActivityIndicator color={c.ink} />
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
    <View style={[styles.sheetRootView, { paddingTop: modalTopInset }]}>
      {/* BottomSheetHeader(11c): 좌 44 닫기 + 가운데 제목. */}
      <View style={styles.sheetHeader}>
        <Pressable
          onPress={() => router.back()}
          style={styles.sheetHeaderClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="닫기"
        >
          <IconClose size={22} color={c.body} />
        </Pressable>
        <Text style={styles.sheetHeaderTitle}>단어 상세</Text>
        <View style={styles.sheetHeaderSpacer} />
      </View>

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
        <View style={styles.headActions}>
          <Pressable
            style={[styles.ttsBtn, tts.status === 'unsupported' && styles.ttsBtnOff]}
            onPress={() => tts.speakAudio('word', w.id, w.reading_kana)}
            disabled={!tts.enabled || tts.status === 'unsupported'}
            accessibilityLabel="발음 듣기"
            accessibilityRole="button"
          >
            <View style={styles.ttsBtnInner}>
              <IconSpeaker size={18} color={c.ink} />
              <Text style={styles.ttsIcon}>발음 듣기</Text>
            </View>
          </Pressable>
          <Pressable
            style={styles.dictBtn}
            onPress={() => openDictionary(w.surface)}
            accessibilityLabel="네이버 일본어 사전에서 단어 보기"
            accessibilityRole="link"
          >
            <Text style={styles.dictBtnText}>사전 ↗</Text>
          </Pressable>
        </View>
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
        {posLabelKo(w.part_of_speech) && (
          <Text style={styles.pos}>{posLabelKo(w.part_of_speech)}</Text>
        )}
      </Section>

      {/* 한자 */}
      {(state.kanji.length > 0 || state.kanjiError) && (
        <Section title={`한자 ${state.kanji.length}`}>
          {state.kanjiError ? (
            <Text style={styles.kanjiError}>한자 데이터를 불러오지 못했어요.</Text>
          ) : (
            <View style={styles.kanjiGrid}>
              {state.kanji.map((item, index) => (
                <KanjiCard
                  key={`${item.literal}-${item.position}`}
                  item={item}
                  divided={index > 0}
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
            {examples.map((example) => (
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
                    style={[
                      styles.exampleTts,
                      (!tts.enabled || tts.status === 'unsupported') && styles.exampleTtsOff,
                    ]}
                    accessibilityLabel="예문 발음 듣기"
                    accessibilityRole="button"
                  >
                    <IconSpeaker size={20} color={c.body} />
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
              </View>
            ))}
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
    </View>
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

function KanjiCard({
  item,
  divided,
  onPress,
}: {
  item: KanjiForWord;
  divided: boolean;
  onPress: () => void;
}): React.ReactNode {
  const styles = useThemedStyles(makeStyles);
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
      style={[styles.kanjiCard, divided && styles.kanjiCardDivided]}
      onPress={onPress}
      accessibilityLabel={`${item.literal} 한자 상세 보기`}
      accessibilityRole="button"
    >
      <Text style={styles.kanjiLiteral}>{item.literal}</Text>
      <View style={styles.kanjiContent}>
        {meanings ? <Text style={styles.kanjiMeaning} numberOfLines={2}>{meanings}</Text> : null}
        {readings ? <Text style={styles.kanjiReading} numberOfLines={2}>{readings}</Text> : null}
        {radical ? <Text style={styles.kanjiMeta}>{radical}</Text> : null}
      </View>
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
  const styles = useThemedStyles(makeStyles);
  const isTablet = useIsTablet();
  if (!item) return null;
  const data = item.kanji;

  const openTrace = () => {
    const literal = item.literal;
    const gloss = data?.meanings_ko.slice(0, 3).join(' · ') ?? '';
    onClose();
    router.push({ pathname: '/trace/[literal]', params: { literal, gloss } });
  };

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
          {isTablet ? (
            <Pressable
              style={styles.sheetTraceBtn}
              onPress={openTrace}
              accessibilityRole="button"
              accessibilityLabel={`${item.literal} 따라쓰기`}
            >
              <Text style={styles.sheetTraceText}>✎ 따라쓰기</Text>
            </Pressable>
          ) : null}
          <View style={styles.sheetActions}>
            <Pressable
              style={styles.sheetDictBtn}
              onPress={() => onOpenDictionary(item.literal)}
              accessibilityLabel="네이버에서 한자 보기"
              accessibilityRole="link"
            >
              <Text style={styles.sheetDictText}>사전 ↗</Text>
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
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: c.softer },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: layout.gapTight,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  emptyText: { ...typography.body, color: c.body, fontFamily: font.medium },
  errorDetail: { ...typography.overline, color: c.body, textAlign: 'center', textTransform: 'none', letterSpacing: 0 },
  head: {
    backgroundColor: c.canvas,
    borderRadius: radius.card,
    ...cardShadow(c),
    paddingHorizontal: spacing.xl,
    paddingVertical: 24,
    alignItems: 'center',
  },
  levelBadge: {
    backgroundColor: c.soft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    marginBottom: 14,
  },
  levelText: { ...typography.overline, color: c.ink, textTransform: 'none' },
  surface: { ...typography.cardWord, color: c.ink, textAlign: 'center' },
  furigana: { ...typography.caption, color: c.body },
  reading: { ...typography.reading, color: c.body, marginTop: 6 },
  headActions: { flexDirection: 'row', gap: spacing.sm, marginTop: 18 },
  ttsBtn: {
    backgroundColor: c.soft,
    borderRadius: radius.pill,
    minHeight: layout.touchTarget,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  ttsBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ttsBtnOff: { opacity: 0.4 },
  ttsIcon: { ...typography.caption, color: c.ink, fontFamily: font.medium },
  ttsHint: { ...typography.overline, color: c.body, marginTop: 2, textTransform: 'none', letterSpacing: 0 },
  dictBtn: {
    borderWidth: 1.5,
    borderColor: c.pressed,
    borderRadius: radius.pill,
    minHeight: layout.touchTarget,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  dictBtnText: { ...typography.caption, color: c.ink, fontFamily: font.medium },
  section: {
    backgroundColor: c.canvas,
    borderRadius: radius.card,
    ...cardShadow(c),
    padding: spacing.xl,
  },
  sectionTitle: { ...typography.overline, color: c.body },
  sectionBody: { marginTop: spacing.sm, gap: 6 },
  meaning: { ...typography.meaning, color: c.ink },
  pos: { ...typography.caption, color: c.body },
  exampleStack: { gap: spacing.lg },
  exampleCard: {
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.pressed,
    paddingBottom: spacing.sm,
  },
  exampleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.lg },
  exampleJp: { flex: 1, fontSize: 18, lineHeight: 28, color: c.ink },
  exampleTts: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    borderRadius: radius.pill,
    backgroundColor: c.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exampleTtsOff: { opacity: 0.35 },
  exampleKo: { ...typography.caption, color: c.body, lineHeight: 20 },
  kanjiGrid: {},
  kanjiCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
    paddingVertical: spacing.lg,
  },
  kanjiCardDivided: { borderTopWidth: 1, borderTopColor: c.pressed },
  kanjiLiteral: {
    width: 52,
    fontSize: 40,
    lineHeight: 48,
    color: c.ink,
    fontFamily: font.bold,
    textAlign: 'center',
  },
  kanjiContent: { flex: 1, gap: spacing.xs, minWidth: 0 },
  kanjiMeaning: { fontSize: 17, lineHeight: 22, color: c.ink, fontFamily: font.semibold },
  kanjiReading: { ...typography.body, color: c.body },
  kanjiMeta: { ...typography.overline, color: c.body, textTransform: 'none', letterSpacing: 0 },
  kanjiError: { ...typography.caption, color: c.body },
  infoLine: { ...typography.caption, color: c.ink, lineHeight: 20 },
  infoLabel: { color: c.body, fontFamily: font.medium },
  metaRow: { alignItems: 'center', marginTop: spacing.xs },
  metaText: { ...typography.overline, color: c.body, textTransform: 'none', letterSpacing: 0 },
  sheetRootView: { flex: 1, backgroundColor: c.softer },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    paddingBottom: 6,
  },
  sheetHeaderClose: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 오른쪽 44 스페이서로 제목을 광학 중앙에 둔다.
  sheetHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    ...typography.cardTitle,
    color: c.ink,
  },
  sheetHeaderSpacer: { width: layout.touchTarget },
  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.28)' },
  sheet: {
    backgroundColor: c.canvas,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.pressed,
    marginBottom: 2,
  },
  sheetLiteral: { fontSize: 64, lineHeight: 72, color: c.ink, fontFamily: font.medium, textAlign: 'center' },
  detailLine: { gap: 3 },
  detailLabel: { ...typography.overline, color: c.body, textTransform: 'none', letterSpacing: 0 },
  detailValue: { ...typography.body, color: c.ink, lineHeight: 23 },
  sheetTraceBtn: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: c.pressed,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sheetTraceText: { ...typography.body, color: c.ink, fontFamily: font.medium },
  sheetActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  sheetDictBtn: {
    flex: 1,
    backgroundColor: c.ink,
    borderRadius: radius.pill,
    paddingVertical: 11,
    alignItems: 'center',
  },
  sheetDictText: { ...typography.caption, color: c.onInk, fontFamily: font.medium },
  sheetCloseBtn: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.pressed,
    alignItems: 'center',
  },
  sheetCloseText: { ...typography.caption, color: c.ink, fontFamily: font.medium },
});
